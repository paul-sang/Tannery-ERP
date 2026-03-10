from django.contrib import admin
from .models import Customer, SalesOrder, SalesOrderDetail

class SalesOrderDetailInline(admin.TabularInline):
    model = SalesOrderDetail
    extra = 1

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'tax_id')
    search_fields = ('name',)

@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'date_ordered', 'status', 'total_amount')
    list_filter = ('status', 'order_date')
    search_fields = ('order_number', 'customer__name')
    inlines = [SalesOrderDetailInline]

    def date_ordered(self, obj):
        return obj.order_date.strftime("%Y-%m-%d")
    date_ordered.short_description = 'Date'
