from django.contrib import admin
from .models import ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')

@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(admin.ModelAdmin):
    list_display = ('name', 'abbreviation')

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('sku', 'name', 'category', 'uom', 'secondary_uom')
    search_fields = ('sku', 'name')
    list_filter = ('category',)

@admin.register(StockLot)
class StockLotAdmin(admin.ModelAdmin):
    list_display = ('lot_tracking_number', 'item', 'current_primary_quantity', 'current_secondary_quantity')
    search_fields = ('lot_tracking_number', 'item__name')

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('stock_lot', 'movement_type', 'quantity', 'date', 'user')
    list_filter = ('movement_type', 'date')
