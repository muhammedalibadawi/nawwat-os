from datetime import datetime
import json
import uuid
from sqlalchemy import or_, and_
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/communication", tags=["Communication Hub"])


@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.Notification).filter(
        models.Notification.tenant_id == tenant.id,
        models.Notification.user_id == "EMP-001",
    ).order_by(models.Notification.timestamp.desc()).all()


@router.post("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: str,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.tenant_id == tenant.id,
    ).first()
    if notif:
        notif.is_read = 1
        db.commit()
    return {"status": "ok"}


@router.get("/meetings")
def get_meetings(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.Meeting).filter(
        models.Meeting.tenant_id == tenant.id
    ).all()


@router.get("/chat/users")
def get_chat_users(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    users = db.query(models.User).filter(
        models.User.tenant_id == tenant.id,
        models.User.id != "EMP-001",
    ).all()
    return [{"id": u.id, "name": u.name, "avatar": u.avatar, "role": u.role, "status": u.status} for u in users]


@router.get("/chat/messages")
def get_chat_messages(
    receiver_id: str | None = None,
    is_group: int = 0,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    query = db.query(models.ChatMessage).filter(
        models.ChatMessage.tenant_id == tenant.id
    )
    if is_group:
        query = query.filter(models.ChatMessage.is_group_chat == 1)
    elif receiver_id:
        query = query.filter(
            models.ChatMessage.is_group_chat == 0,
            or_(
                and_(models.ChatMessage.sender_id == "EMP-001", models.ChatMessage.receiver_id == receiver_id),
                and_(models.ChatMessage.sender_id == receiver_id, models.ChatMessage.receiver_id == "EMP-001"),
            ),
        )
    return query.order_by(models.ChatMessage.timestamp.asc()).all()


class NewMessage(BaseModel):
    receiver_id: str | None = None
    message: str
    is_group_chat: int = 0


@router.post("/chat/messages")
def send_chat_message(
    msg: NewMessage,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    new_msg = models.ChatMessage(
        id=f"msg-{str(uuid.uuid4())[:8]}",
        tenant_id=tenant.id,
        sender_id="EMP-001",
        receiver_id=msg.receiver_id,
        message=msg.message,
        is_group_chat=msg.is_group_chat,
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return new_msg
