import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/products", tags=["Inventory"])


class ProductCreateUpdate(BaseModel):
    name: str
    price: float
    category: str
    stock: int
    min_stock_level: int
    barcode: str | None = None
    sku: str | None = None
    ingredients: str | None = None


class CartItem(BaseModel):
    id: str
    price: float
    quantity: int


class CheckoutRequest(BaseModel):
    cart: list[CartItem]
    payment_method: str = "cash"


@router.get("/")
def get_products(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    try:
        return db.query(models.Product).filter(models.Product.tenant_id == tenant.id).all()
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@router.post("/")
def create_product(
    product: ProductCreateUpdate,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    new_product = models.Product(
        id=f"P-{uuid.uuid4().hex[:8].upper()}",
        tenant_id=tenant.id,
        name=product.name,
        price=product.price,
        category=product.category,
        stock=product.stock,
        min_stock_level=product.min_stock_level,
        barcode=product.barcode,
        sku=product.sku,
        ingredients=product.ingredients,
    )
    db.add(new_product)
    db.commit()
    return new_product


@router.put("/{product_id}")
def update_product(
    product_id: str,
    product: ProductCreateUpdate,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.tenant_id == tenant.id,
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db_product.name = product.name
    db_product.price = product.price
    db_product.category = product.category
    db_product.stock = product.stock
    db_product.min_stock_level = product.min_stock_level
    db_product.barcode = product.barcode
    db_product.sku = product.sku
    db_product.ingredients = product.ingredients
    db.commit()
    return db_product


@router.delete("/{product_id}")
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.tenant_id == tenant.id,
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(db_product)
    db.commit()
    return {"status": "success"}


@router.post("/checkout")
def pos_checkout(
    req: CheckoutRequest,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    from accounting import create_balanced_entry
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    order_id = f"ORD-{str(uuid.uuid4().hex)[0:8].upper()}"
    user_id = "EMP-004"
    total_amount = 0.0
    total_tax = 0.0
    for item in req.cart:
        item_total = item.price * item.quantity
        total_amount += item_total
        product = db.query(models.Product).filter(
            models.Product.id == item.id,
            models.Product.tenant_id == tenant.id,
        ).first()
        if product:
            item_tax = item_total * (getattr(product, "tax_rate", None) or 0.0)
            total_tax += item_tax
            product.stock -= item.quantity
            sm = models.StockMovement(
                id=f"sm-{str(uuid.uuid4().hex)[0:8]}",
                tenant_id=tenant.id,
                product_id=product.id,
                movement_type="OUT",
                quantity=item.quantity,
                date=now,
                reference=order_id,
            )
            db.add(sm)
            if product.stock < product.min_stock_level:
                alert = models.Notification(
                    id=f"notif-{str(uuid.uuid4().hex)[0:8]}",
                    tenant_id=tenant.id,
                    user_id=user_id,
                    title="Low Stock Alert",
                    message=f"Product '{product.name}' stock dropped to {product.stock} (Min: {product.min_stock_level}).",
                    timestamp=now,
                )
                db.add(alert)
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == tenant.id,
    ).first()
    commission_rate = user.commission_rate if user and user.commission_rate else 0.05
    commission_amount = total_amount * commission_rate
    commission_record = models.Commission(
        id=f"comm-{str(uuid.uuid4().hex)[0:8]}",
        tenant_id=tenant.id,
        user_id=user_id,
        sale_amount=total_amount,
        commission_amount=commission_amount,
        date=now,
    )
    db.add(commission_record)
    account_debit = "Assets:Bank" if req.payment_method == "bank" else "Assets:Cash"
    lines = [
        {"account_id": account_debit, "debit": total_amount, "credit": 0.0},
        {"account_id": "Revenue:Sales", "debit": 0.0, "credit": total_amount - total_tax},
    ]
    if total_tax > 0:
        lines.append({"account_id": "Liabilities:Tax", "debit": 0.0, "credit": total_tax})
    create_balanced_entry(db, tenant.id, f"POS Sale {order_id}", lines)
    points_earned = int(total_amount / 100)
    if points_earned > 0:
        emp_points = db.query(models.EmployeePoints).filter(
            models.EmployeePoints.user_id == user_id,
            models.EmployeePoints.tenant_id == tenant.id,
        ).first()
        if not emp_points:
            emp_points = models.EmployeePoints(
                id=f"pts-{str(uuid.uuid4().hex)[0:8]}",
                tenant_id=tenant.id,
                user_id=user_id,
                total_points=0,
                current_streak_days=1,
                last_activity_date=now[:10],
            )
            db.add(emp_points)
        emp_points.total_points += points_earned
    db.commit()
    return {
        "status": "success",
        "order_id": order_id,
        "total": total_amount,
        "commission_earned": commission_amount,
        "points_earned": points_earned,
    }
