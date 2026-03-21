from sqlalchemy.orm import Session
import models
import uuid
from datetime import datetime

def create_balanced_entry(db: Session, tenant_id: str, description: str, lines: list):
    """
    lines: list of dicts {'account_id': str, 'debit': float, 'credit': float}
    """
    total_debit = sum(line['debit'] for line in lines)
    total_credit = sum(line['credit'] for line in lines)
    
    if abs(total_debit - total_credit) > 0.001:
        raise ValueError(f"Entry is not balanced: Debit({total_debit}) != Credit({total_credit})")
    
    entry_id = f"JRN-{uuid.uuid4().hex[:8].upper()}"
    new_entry = models.JournalEntry(
        id=entry_id,
        tenant_id=tenant_id,
        entry_number=entry_id,
        entry_date=datetime.now().strftime("%Y-%m-%d"),
        description=description,
        status="posted"
    )
    db.add(new_entry)
    
    for line in lines:
        line_item = models.JournalEntryLine(
            id=str(uuid.uuid4()),
            entry_id=entry_id,
            account_id=line['account_id'],
            debit=line['debit'],
            credit=line['credit']
        )
        db.add(line_item)
    
    db.commit()
    return new_entry

def reverse_entry(db: Session, entry_id: str, tenant_id: str):
    """عكس قيد محاسبي (Storno) لتصحيح الأخطاء دون مسح البيانات"""
    original = db.query(models.JournalEntry).filter(
        models.JournalEntry.id == entry_id, 
        models.JournalEntry.tenant_id == tenant_id
    ).first()
    
    if not original or original.status == "reversed":
        return None
        
    lines = db.query(models.JournalEntryLine).filter(models.JournalEntryLine.entry_id == entry_id).all()
    reversed_lines = []
    for l in lines:
        reversed_lines.append({
            'account_id': l.account_id,
            'debit': l.credit, # اعكس المدين دائن
            'credit': l.debit  # اعكس الدائن مدين
        })
    
    original.status = "reversed"
    return create_balanced_entry(db, tenant_id, f"Reversal of {entry_id}", reversed_lines)
