from django.contrib import admin
from .models import Supplier, PurchaseOrder, PurchaseOrderDetail

class PurchaseOrderDetailInline(admin.TabularInline):
    model = PurchaseOrderDetail
    extra = 1

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'tax_id')
    search_fields = ('name',)

@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'supplier', 'date_ordered', 'status', 'total_amount')
    list_filter = ('status', 'order_date')
    search_fields = ('order_number', 'supplier__name')
    inlines = [PurchaseOrderDetailInline]

    def date_ordered(self, obj):
        return obj.order_date.strftime("%Y-%m-%d")
    date_ordered.short_description = 'Date'
