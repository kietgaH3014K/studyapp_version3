import os
import re
import json
import logging
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import ensure_csrf_cookie
from openai import OpenAI
from .models import ProgressLog
from .serializers import (
    ProgressLogSerializer,
    RegisterSerializer,
    UserSerializer,
)

# Setup logging
logger = logging.getLogger(__name__)

# =========================
# OpenAI (DeepInfra) client
# =========================
DEEPINFRA_API_KEY = os.environ.get("DEEPINFRA_API_KEY")

# Chỉ ghi nhận key đã được cấu hình; không ghi một phần secret vào log.
logger.info("DEEPINFRA_API_KEY configured: %s", bool(DEEPINFRA_API_KEY))

if not DEEPINFRA_API_KEY:
    logger.error("DEEPINFRA_API_KEY environment variable is not set!")
    # Trong development, có thể dùng một key mặc định
    # Nhưng trong production PHẢI raise error
    if os.environ.get("DJANGO_DEBUG", "false").lower() == "true":
        logger.warning("Using default API key for development only!")
        DEEPINFRA_API_KEY = "your_development_key_here"
    else:
        raise ValueError("DEEPINFRA_API_KEY environment variable is required in production")

try:
    openai = OpenAI(
        api_key=DEEPINFRA_API_KEY,
        base_url="https://api.deepinfra.com/v1/openai",
    )
    logger.info("OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {e}")
    raise

# =========================
# Helpers
# =========================
def normalize_status(value: str) -> str:
    """Normalize arbitrary status strings into 'pending' or 'done'."""
    if not value:
        return "pending"
    v = value.strip().lower()
    return "done" if v == "done" else "pending"

# =========================================
# Generate learning path (store per-user)
# =========================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_learning_path(request):
    """
    Body JSON:
    {
      "class_level": "10",
      "subject": "Tin học",
      "study_time": "1 giờ",
      "goal": "Nắm vững Python cơ bản"
    }
    """
    try:
        # Log request data
        logger.info(f"generate_learning_path called by user: {request.user.username}")
        logger.info(f"Request data: {request.data}")
        
        data = request.data
        class_level = (data.get("class_level") or "").strip()
        subject = (data.get("subject") or "").strip()
        study_time = (data.get("study_time") or "").strip()
        goal = (data.get("goal") or "").strip()
        
        if not all([class_level, subject, study_time, goal]):
            logger.warning("Missing required fields")
            return Response(
                {"error": "Thiếu thông tin bắt buộc."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prompt
        messages = [
    {
        "role": "system",
        "content": (
            "Bạn là chuyên gia lập kế hoạch tự học. Trả lời HOÀN TOÀN bằng tiếng Việt."
        ),
    },
    {
        "role": "user",
        "content": f"""
Hãy lập kế hoạch tự học 4 tuần (28 ngày) cho học sinh lớp {class_level} muốn cải thiện môn {subject}.
Học sinh học {study_time} mỗi ngày. Mục tiêu: {goal}.

YÊU CẦU BẮT BUỘC:
- Trả lời CHÍNH XÁC 28 dòng, mỗi dòng 1 ngày.
- KHÔNG thêm tiêu đề, KHÔNG markdown, KHÔNG code block.
- Định dạng MỖI DÒNG: "Ngày N: <nội dung ngắn gọn> | Link tài liệu: <URL>"
- <URL> phải bắt đầu bằng http(s)://. Nếu không có nguồn phù hợp, ghi "không có".
- Chỉ in các dòng "Ngày 1"… "Ngày 28". Không in bất kỳ nội dung nào khác.

Ví dụ:
Ngày 1: Ôn kiến thức A | Link tài liệu: https://example.com/tai-lieu-A
Ngày 2: ...
... đến Ngày 28
""",
    },
]
        
        # Call LLM with better error handling
        logger.info("Calling DeepInfra API...")
        try:
            resp = openai.chat.completions.create(
                model="openchat/openchat_3.5",
                messages=messages,
                stream=False,
                max_tokens=2000,  # Limit response length
                temperature=0.7   # Add some creativity
            )
            logger.info("DeepInfra API call successful")
        except Exception as api_error:
            logger.error(f"DeepInfra API error: {str(api_error)}")
            logger.error(f"Error type: {type(api_error).__name__}")
            
            # Check specific error types
            error_message = str(api_error)
            if "api_key" in error_message.lower():
                return Response(
                    {"error": "Lỗi xác thực API key. Vui lòng kiểm tra cấu hình."}, 
                    status=500
                )
            elif "rate" in error_message.lower():
                return Response(
                    {"error": "Đã vượt quá giới hạn API. Vui lòng thử lại sau."}, 
                    status=429
                )
            else:
                return Response(
                    {
                        "error": "Lỗi khi gọi AI service",
                        "details": str(api_error)[:200]  # Limit error message length
                    }, 
                    status=500
                )
        
        # Parse response
        try:
            gpt_text_vi = (resp.choices[0].message.content or "").strip()
            logger.info(f"GPT response length: {len(gpt_text_vi)}")
            
            if not gpt_text_vi:
                logger.error("Empty response from GPT")
                return Response(
                    {"error": "Không nhận được phản hồi từ AI"}, 
                    status=500
                )
        except Exception as parse_error:
            logger.error(f"Error parsing GPT response: {parse_error}")
            return Response(
                {"error": "Lỗi xử lý phản hồi từ AI"}, 
                status=500
            )
        
        # Parse "Ngày N: ..."
        day_line_regex = re.compile(r"^Ngày\s+(\d{1,2})\s*[:\-\–]\s*(.+)$", re.IGNORECASE)
        plan = {}
        
        for raw in gpt_text_vi.splitlines():
            line = raw.strip()
            if not line:
                continue
            m = day_line_regex.match(line)
            if not m:
                continue
            day_num = int(m.group(1))
            if 1 <= day_num <= 28:
                plan[day_num] = m.group(2).strip()
        
        logger.info(f"Parsed {len(plan)} days from GPT response")
        
        if not plan:
            logger.error("Could not parse any days from GPT response")
            logger.error(f"First 500 chars of response: {gpt_text_vi[:500]}")
            
            # Fallback: Create a simple default plan
            logger.info("Using fallback plan generation")
            for day in range(1, 29):
                week = (day - 1) // 7 + 1
                plan[day] = f"Tuần {week} - Ngày {day}: Học {subject} - {goal}"
        
        # Save to DB (per user & subject)
        user = request.user
        try:
            with transaction.atomic():
                # Delete old progress for this subject
                deleted_count = ProgressLog.objects.filter(
                    user=user, 
                    subject=subject
                ).delete()[0]
                logger.info(f"Deleted {deleted_count} old progress logs")
                
                # Create new progress logs
                objs = []
                for day_number in sorted(plan.keys()):
                    task_text = str(plan[day_number])
                    week = (day_number - 1) // 7 + 1
                    objs.append(ProgressLog(
                        user=user,
                        subject=subject,
                        week=week,
                        day_number=day_number,
                        task_title=task_text,
                        status="pending",
                    ))
                
                created_logs = ProgressLog.objects.bulk_create(objs)
                logger.info(f"Created {len(created_logs)} new progress logs")
        except Exception as db_error:
            logger.error(f"Database error: {db_error}")
            return Response(
                {"error": "Lỗi lưu dữ liệu vào database"}, 
                status=500
            )
        
        # Return success response
        logs = ProgressLog.objects.filter(
            user=user, 
            subject=subject
        ).order_by("week", "day_number")
        
        return Response(
            {
                "message": "✅ Đã tạo lộ trình học!",
                "subject": subject,
                "items": ProgressLogSerializer(logs, many=True).data,
                "raw_gpt_output": gpt_text_vi[:1000],  # Limit output size
            },
            status=201,
        )
        
    except Exception as unexpected_error:
        logger.error(f"Unexpected error in generate_learning_path: {unexpected_error}")
        logger.error(f"Error type: {type(unexpected_error).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return Response(
            {
                "error": "Lỗi không xác định",
                "details": str(unexpected_error)[:200]
            },
            status=500
        )

# =========================================
# Get progress list
# =========================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_progress_list(request):
    try:
        subject = request.query_params.get("subject")
        user = request.user
        qs = ProgressLog.objects.filter(user=user).order_by("subject", "week", "day_number")
        if subject:
            qs = qs.filter(subject=subject)
        return Response(ProgressLogSerializer(qs, many=True).data, status=200)
    except Exception as e:
        logger.error(f"Error in get_progress_list: {e}")
        return Response({"error": "Lỗi lấy danh sách tiến độ"}, status=500)

# =========================================
# Update progress status
# =========================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_progress_status(request):
    try:
        log_id = request.data.get("id")
        new_status_raw = request.data.get("status")
        
        if not log_id or new_status_raw is None:
            return Response(
                {"error": "Thiếu thông tin 'id' hoặc 'status'."}, 
                status=400
            )
        
        try:
            log = ProgressLog.objects.get(id=log_id, user=request.user)
        except ProgressLog.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy bản ghi của bạn"}, 
                status=404
            )
        
        log.status = normalize_status(new_status_raw)
        log.save(update_fields=["status"])
        
        return Response(
            {
                "message": "Cập nhật trạng thái thành công!", 
                "item": ProgressLogSerializer(log).data
            },
            status=200,
        )
    except Exception as e:
        logger.error(f"Error in update_progress_status: {e}")
        return Response({"error": "Lỗi cập nhật trạng thái"}, status=500)

# =========================================
# AI adaptive learning path (preview + confirm)
# =========================================
def _adaptive_slots(logs):
    """Return deterministic new positions for pending tasks, preserving done tasks."""
    done_days = {int(item.day_number) for item in logs if item.status == "done"}
    # ProgressLog.created_at is the plan's creation timestamp. Use elapsed calendar
    # days as a practical estimate of the current plan day, so overdue tasks move forward.
    first_created = min((item.created_at for item in logs if item.created_at), default=None)
    elapsed_day = 1
    if first_created:
        elapsed_day = max(1, (timezone.localdate() - timezone.localtime(first_created).date()).days + 1)
    cursor = max(max(done_days, default=0), elapsed_day - 1) + 1
    positions = {}
    pending = sorted(
        (item for item in logs if item.status != "done"),
        key=lambda item: (item.week, item.day_number, item.id),
    )
    for item in pending:
        while cursor in done_days:
            cursor += 1
        positions[item.id] = {
            "day_number": cursor,
            "week": ((cursor - 1) // 7) + 1,
        }
        cursor += 1
    return positions, pending


def _preserve_resource_link(original_title, rewritten_title):
    """Keep the original learning-resource URL when the model omits it."""
    marker = "Link tài liệu:"
    if marker not in (original_title or ""):
        return rewritten_title.strip()
    suffix = original_title[original_title.find(marker):].strip()
    # Keep the exact original resource suffix even if the model rewrites the URL.
    rewritten_base = rewritten_title.split(marker)[0].strip() if marker.lower() in rewritten_title.lower() else rewritten_title.strip()
    return f"{rewritten_base} | {suffix}"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def adapt_learning_path(request):
    """Create an AI proposal only; do not write changes to the database here."""
    subject = str(request.data.get("subject") or "").strip()
    reason = str(request.data.get("reason") or "").strip()[:500]
    try:
        available_minutes = int(request.data.get("available_minutes_per_day", 60))
    except (TypeError, ValueError):
        return Response({"error": "Thời gian học phải là số phút."}, status=400)

    if not subject:
        return Response({"error": "Vui lòng chọn môn học cần điều chỉnh."}, status=400)
    if not 15 <= available_minutes <= 360:
        return Response({"error": "Thời gian học mỗi ngày phải từ 15 đến 360 phút."}, status=400)

    logs = list(ProgressLog.objects.filter(
        user=request.user, subject=subject
    ).order_by("week", "day_number", "id"))
    if not logs:
        return Response({"error": "Môn học này chưa có lộ trình để điều chỉnh."}, status=404)

    positions, pending = _adaptive_slots(logs)
    if not pending:
        return Response({"error": "Bạn đã hoàn thành toàn bộ lộ trình môn học này."}, status=400)

    task_payload = [
        {"id": item.id, "week": item.week, "day_number": item.day_number,
         "task_title": item.task_title}
        for item in pending
    ]
    prompt = f"""
Hãy điều chỉnh lộ trình tự học môn {subject} cho học sinh phổ thông.
Thời gian có thể học mỗi ngày: {available_minutes} phút.
Lý do/khó khăn học sinh cung cấp: {reason or 'Chưa cung cấp; hãy phân bổ khối lượng vừa sức.'}

Các nhiệm vụ chưa hoàn thành (giữ nguyên id, không thêm hoặc bỏ nhiệm vụ):
{json.dumps(task_payload, ensure_ascii=False)}

Yêu cầu:
- Viết lại task_title cho phù hợp với thời lượng, chia nhỏ nhiệm vụ dài, ưu tiên kiến thức nền tảng và ôn tập xen kẽ.
- Không tự nhận rằng học sinh đã hoàn thành nhiệm vụ nào.
- Giữ nguyên URL/link tài liệu nếu tiêu đề có chứa link.
- Chỉ trả về JSON hợp lệ, không Markdown, theo cấu trúc:
{{"summary":"một câu giải thích ngắn bằng tiếng Việt","recommendations":[{{"id":123,"task_title":"nội dung nhiệm vụ mới"}}]}}
- Phải trả về đúng một recommendation cho mỗi id đầu vào; id là số nguyên, task_title là chuỗi tiếng Việt ngắn gọn.
"""
    try:
        response = openai.chat.completions.create(
            model="openchat/openchat_3.5",
            messages=[
                {"role": "system", "content": "Bạn là trợ lý học tập. Trả lời bằng tiếng Việt, tuân thủ chính xác định dạng JSON được yêu cầu."},
                {"role": "user", "content": prompt},
            ],
            stream=False,
            max_tokens=min(3500, 500 + len(pending) * 120),
            temperature=0.4,
        )
        raw = (response.choices[0].message.content or "").strip()
        # Tolerate a model that wraps its JSON in a code fence.
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE).strip()
        first, last = raw.find("{"), raw.rfind("}")
        if first < 0 or last <= first:
            raise ValueError("AI không trả về JSON hợp lệ.")
        result = json.loads(raw[first:last + 1])
        recommendations = result.get("recommendations")
        if not isinstance(recommendations, list):
            raise ValueError("Thiếu danh sách recommendations.")
        by_id = {}
        for recommendation in recommendations:
            if not isinstance(recommendation, dict):
                continue
            try:
                item_id = int(recommendation.get("id"))
            except (TypeError, ValueError):
                continue
            title = recommendation.get("task_title")
            if isinstance(title, str) and title.strip():
                by_id[item_id] = title.strip()[:2000]

        expected_ids = {item.id for item in pending}
        if set(by_id) != expected_ids:
            raise ValueError("AI trả về thiếu hoặc thừa nhiệm vụ; vui lòng thử lại.")

        changes = []
        for item in pending:
            new_title = _preserve_resource_link(item.task_title, by_id[item.id])
            slot = positions[item.id]
            changes.append({
                "id": item.id,
                "old_task_title": item.task_title,
                "task_title": new_title,
                "old_week": item.week,
                "old_day_number": item.day_number,
                "week": slot["week"],
                "day_number": slot["day_number"],
                "status": item.status,
            })
        return Response({
            "subject": subject,
            "summary": str(result.get("summary") or "Đã đề xuất điều chỉnh các nhiệm vụ chưa hoàn thành.")[:500],
            "available_minutes_per_day": available_minutes,
            "changes": changes,
        }, status=200)
    except Exception as exc:
        logger.warning("Adaptive roadmap preview failed for user %s: %s", request.user.pk, exc)
        return Response({
            "error": "AI chưa thể tạo đề xuất lúc này. Vui lòng thử lại sau.",
        }, status=502)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_adapted_learning_path(request):
    """Persist a previously previewed proposal after explicit user confirmation."""
    subject = str(request.data.get("subject") or "").strip()
    changes = request.data.get("changes")
    if not subject or not isinstance(changes, list) or not changes:
        return Response({"error": "Thiếu môn học hoặc danh sách thay đổi."}, status=400)

    with transaction.atomic():
        logs = list(ProgressLog.objects.select_for_update().filter(
            user=request.user, subject=subject
        ).order_by("week", "day_number", "id"))
        positions, pending = _adaptive_slots(logs)
        expected_ids = {item.id for item in pending}
        supplied = {}
        for change in changes:
            if not isinstance(change, dict):
                return Response({"error": "Dữ liệu điều chỉnh không hợp lệ."}, status=400)
            try:
                item_id = int(change.get("id"))
            except (TypeError, ValueError):
                return Response({"error": "ID nhiệm vụ không hợp lệ."}, status=400)
            title = change.get("task_title")
            if not isinstance(title, str) or not title.strip():
                return Response({"error": "Nội dung nhiệm vụ không được để trống."}, status=400)
            supplied[item_id] = title.strip()[:2000]

        if set(supplied) != expected_ids:
            return Response({
                "error": "Tiến độ đã thay đổi kể từ lúc xem trước. Hãy tạo đề xuất mới trước khi áp dụng."
            }, status=409)

        by_id = {item.id: item for item in pending}
        for item_id, title in supplied.items():
            item = by_id[item_id]
            slot = positions[item_id]
            item.task_title = title
            item.week = slot["week"]
            item.day_number = slot["day_number"]
            item.save(update_fields=["task_title", "week", "day_number", "updated_at"])

    updated = ProgressLog.objects.filter(
        user=request.user, subject=subject
    ).order_by("week", "day_number", "id")
    return Response({
        "message": "Đã áp dụng lộ trình học tập được điều chỉnh.",
        "subject": subject,
        "items": ProgressLogSerializer(updated, many=True).data,
    }, status=200)


# =========================================
# Auth & CSRF endpoints (không thay đổi)
# =========================================
@api_view(["GET"])
@ensure_csrf_cookie
@permission_classes([AllowAny])
def get_csrf(request):
    return Response({"csrfToken": request.META.get("CSRF_COOKIE", "")})

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {
                "message": "Đăng ký thành công!", 
                "user": UserSerializer(user).data
            }, 
            status=201
        )
    return Response(serializer.errors, status=400)

@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(request, username=username, password=password)
    
    if not user:
        return Response(
            {"detail": "Sai tên đăng nhập hoặc mật khẩu."}, 
            status=400
        )
    
    login(request, user)
    return Response(
        {
            "message": "Đăng nhập thành công!", 
            "username": user.username
        }
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"message": "Đã đăng xuất."})

@api_view(["GET"])
@permission_classes([AllowAny])
def whoami(request):
    if request.user.is_authenticated:
        return Response({"username": request.user.username})
    return Response({"username": None}, status=200)
