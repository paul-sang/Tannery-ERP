from django.db import models
from apps.users.models import User

class ProductCategory(models.Model):
    CATEGORY_CHOICES = [
        ('RAW_HIDE', 'Raw Hide'),
        ('CHEMICAL', 'Chemical'),
        ('FINISHED_LEATHER', 'Finished Leather'),
        ('SUPPLIES', 'Supplies'),
    ]
    name = models.CharField(max_length=50, choices=CATEGORY_CHOICES, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.get_name_display()

class UnitOfMeasure(models.Model):
    name = models.CharField(max_length=50, unique=True)
    abbreviation = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f"{self.name} ({self.abbreviation})"

class Item(models.Model):
    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name='items')
    uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name='items_primary')
    secondary_uom = models.ForeignKey(UnitOfMeasure, on_delete=models.SET_NULL, null=True, blank=True, related_name='items_secondary')
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    attributes = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"[{self.sku}] {self.name}"

class StockLot(models.Model):
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='lots')
    lot_tracking_number = models.CharField(max_length=100, unique=True)
    
    source_batch = models.ForeignKey('production.ProductionBatch', on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_lots')
    source_purchase_detail = models.ForeignKey('purchases.PurchaseOrderDetail', on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_lots')
    
    current_primary_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    current_secondary_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"Lot {self.lot_tracking_number} - {self.item.name}"

class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        IN = 'IN', 'In'
        OUT = 'OUT', 'Out'
        ADJUSTMENT = 'ADJ', 'Adjustment'

    stock_lot = models.ForeignKey(StockLot, on_delete=models.PROTECT, related_name='movements')
    movement_type = models.CharField(max_length=3, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    secondary_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    reference_document = models.CharField(max_length=100)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='stock_movements')

    def __str__(self):
        return f"{self.movement_type} {self.quantity} of {self.stock_lot.lot_tracking_number}"
