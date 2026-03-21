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


class Location(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class Item(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INACTIVE = 'INACTIVE', 'Inactive'

    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name='items')
    uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name='items_primary')
    secondary_uom = models.ForeignKey(UnitOfMeasure, on_delete=models.SET_NULL, null=True, blank=True, related_name='items_secondary')
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    reorder_point = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    attributes = models.JSONField(default=dict, blank=True)
    track_by_lot = models.BooleanField(default=True)
    current_stock = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    def __str__(self):
        return f"[{self.sku}] {self.name}"

    @property
    def reserved_stock(self):
        # Placeholder for future logic where stock is tied up in unfulfilled sales or production orders
        return 0.00

    @property
    def in_transit_stock(self):
        # Placeholder for future logic where stock is incoming from purchase orders
        return 0.00


class ItemPriceHistory(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='price_history')
    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    effective_date = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=50, default='MANUAL')
    reference_document = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.item.name} - {self.price} {self.currency} ({self.effective_date.date()})"
    
    class Meta:
        ordering = ['-effective_date']


# --- Inventory Document (Universal Movement Document) ---

class InventoryDocument(models.Model):
    class DocumentType(models.TextChoices):
        ADJUSTMENT = 'ADJ', 'Adjustment'
        PURCHASE_RECEIPT = 'PUR', 'Purchase Receipt'
        SALES_DISPATCH = 'SAL', 'Sales Dispatch'
        PRODUCTION_CONSUMPTION = 'PCN', 'Production Consumption'
        PRODUCTION_OUTPUT = 'POT', 'Production Output'
        TRANSFER = 'TRF', 'Transfer'
        INITIAL_BALANCE = 'INI', 'Initial Balance'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        VOIDED = 'VOIDED', 'Voided'

    document_number = models.CharField(max_length=100, unique=True)
    document_type = models.CharField(max_length=3, choices=DocumentType.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    date = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='inventory_documents')

    # Optional traceability references
    purchase_order = models.ForeignKey(
        'purchases.PurchaseOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='inventory_documents'
    )
    sales_order = models.ForeignKey(
        'sales.SalesOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='inventory_documents'
    )
    production_batch = models.ForeignKey(
        'production.ProductionBatch', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='inventory_documents'
    )

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.document_number}"

    class Meta:
        ordering = ['-date']


class InventoryDocumentLine(models.Model):
    class MovementType(models.TextChoices):
        IN = 'IN', 'In'
        OUT = 'OUT', 'Out'

    document = models.ForeignKey(InventoryDocument, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='document_lines')
    stock_lot = models.ForeignKey('StockLot', on_delete=models.PROTECT, null=True, blank=True, related_name='document_lines')
    movement_type = models.CharField(max_length=3, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    secondary_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        lot_info = f" (Lot: {self.stock_lot.lot_tracking_number})" if self.stock_lot else ""
        return f"{self.movement_type} {self.quantity} x {self.item.name}{lot_info}"


# --- Stock Lot ---

class StockLot(models.Model):
    class GradeChoices(models.TextChoices):
        TR = 'TR', 'TR'
        A = 'A', 'A'
        B = 'B', 'B'
        C = 'C', 'C'
        REJECT = 'REJECT', 'Reject'
        NOT_APPLICABLE = 'NA', 'N/A'

    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='lots')
    lot_tracking_number = models.CharField(max_length=100, unique=True)
    source_document_line = models.ForeignKey(
        InventoryDocumentLine, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='generated_lots'
    )
    current_primary_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    current_secondary_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    # Leather specific / Chemical specific fields
    grade = models.CharField(max_length=10, choices=GradeChoices.choices, default=GradeChoices.NOT_APPLICABLE)
    thickness = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. 1.2 - 1.4 mm")
    average_size = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, help_text="e.g. sqft per hide")
    expiry_date = models.DateField(blank=True, null=True)
    
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name='lots')

    def __str__(self):
        return f"Lot {self.lot_tracking_number} - {self.item.name}"


# --- Stock Movement (Ledger Entry) ---

class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        IN = 'IN', 'In'
        OUT = 'OUT', 'Out'
        ADJUSTMENT = 'ADJ', 'Adjustment'

    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='movements', null=True, blank=True)
    stock_lot = models.ForeignKey(StockLot, on_delete=models.PROTECT, related_name='lot_movements', null=True, blank=True)
    document_line = models.ForeignKey(
        InventoryDocumentLine, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='stock_movements'
    )
    movement_type = models.CharField(max_length=3, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    secondary_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    reference_document = models.CharField(max_length=100, blank=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='stock_movements')

    def __str__(self):
        target = self.stock_lot.lot_tracking_number if self.stock_lot else (self.item.name if self.item else 'Unknown')
        return f"{self.movement_type} {self.quantity} of {target}"
