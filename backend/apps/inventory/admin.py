from django.contrib import admin
from .models import (
    ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement,
    InventoryDocument, InventoryDocumentLine
)

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')

@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(admin.ModelAdmin):
    list_display = ('name', 'abbreviation')

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('sku', 'name', 'category', 'uom', 'secondary_uom', 'track_by_lot', 'current_stock')
    search_fields = ('sku', 'name')
    list_filter = ('category', 'track_by_lot', 'status')

@admin.register(StockLot)
class StockLotAdmin(admin.ModelAdmin):
    list_display = ('lot_tracking_number', 'item', 'current_primary_quantity', 'current_secondary_quantity')
    search_fields = ('lot_tracking_number', 'item__name')

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('item', 'stock_lot', 'movement_type', 'quantity', 'date', 'reference_document', 'user')
    list_filter = ('movement_type', 'date')

class InventoryDocumentLineInline(admin.TabularInline):
    model = InventoryDocumentLine
    extra = 1
    raw_id_fields = ('item', 'stock_lot')

@admin.register(InventoryDocument)
class InventoryDocumentAdmin(admin.ModelAdmin):
    list_display = ('document_number', 'document_type', 'date', 'user', 'notes')
    list_filter = ('document_type', 'date')
    search_fields = ('document_number', 'notes')
    inlines = [InventoryDocumentLineInline]
