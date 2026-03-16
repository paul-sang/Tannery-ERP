from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum, Q, F
from django.utils import timezone
from datetime import timedelta


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Role-aware dashboard stats. Returns all stats; frontend decides visibility per role.
    """
    from apps.inventory.models import Item, StockLot, InventoryDocument
    from apps.production.models import ProductionBatch, ProductionProcess, ProductionStage
    from apps.purchases.models import PurchaseOrder
    from apps.sales.models import SalesOrder

    now = timezone.now()
    last_7d = now - timedelta(days=7)

    # --- Inventory Stats ---
    items_total = Item.objects.filter(status='ACTIVE').count()
    lots_active = StockLot.objects.filter(current_primary_quantity__gt=0).count()
    total_stock_units = Item.objects.filter(status='ACTIVE').aggregate(total=Sum('current_stock'))['total'] or 0
    docs_today = InventoryDocument.objects.filter(date__date=now.date()).count()
    docs_7d = InventoryDocument.objects.filter(date__gte=last_7d).count()

    # Low stock items (current_stock > 0 but <= min_stock_level, or current_stock == 0 with min_stock_level > 0)
    low_stock_items = list(
        Item.objects.filter(
            status='ACTIVE', min_stock_level__gt=0, current_stock__lte=F('min_stock_level')
        )[:10].values('id', 'sku', 'name', 'current_stock', 'min_stock_level')
    )

    # Recent documents
    recent_docs = list(
        InventoryDocument.objects.order_by('-date')[:8].values(
            'id', 'document_number', 'document_type', 'date', 'notes'
        )
    )

    # --- Production Stats ---
    batches_by_status = dict(
        ProductionBatch.objects.values_list('status').annotate(c=Count('id')).values_list('status', 'c')
    )
    active_batches = batches_by_status.get('IN_PROGRESS', 0)
    pending_batches = batches_by_status.get('PENDING', 0)
    qa_hold_batches = batches_by_status.get('QA_HOLD', 0)
    completed_batches = batches_by_status.get('COMPLETED', 0)
    total_processes = ProductionProcess.objects.filter(is_active=True).count()
    total_stages = ProductionStage.objects.count()

    # Recent batches
    recent_batches = list(
        ProductionBatch.objects.select_related('process__stage', 'manager')
        .order_by('-start_date')[:6]
        .values('id', 'batch_number', 'status', 'start_date',
                process_name=F('process__name'),
                stage_name=F('process__stage__name'),
                manager_name=F('manager__username'))
    )

    # --- Commercial Stats ---
    try:
        po_pending = PurchaseOrder.objects.filter(status='PENDING').count()
        po_total = PurchaseOrder.objects.count()
    except Exception:
        po_pending, po_total = 0, 0

    try:
        so_pending = SalesOrder.objects.filter(status='PENDING').count()
        so_total = SalesOrder.objects.count()
    except Exception:
        so_pending, so_total = 0, 0

    return Response({
        'user': {
            'username': request.user.username,
            'role': request.user.role,
            'role_display': request.user.get_role_display(),
            'full_name': request.user.get_full_name() or request.user.username,
        },
        'inventory': {
            'items_total': items_total,
            'low_stock_count': len(low_stock_items),
            'low_stock_items': low_stock_items,
            'lots_active': lots_active,
            'total_stock_units': float(total_stock_units),
            'docs_today': docs_today,
            'docs_7d': docs_7d,
            'recent_documents': recent_docs,
        },
        'production': {
            'active_batches': active_batches,
            'pending_batches': pending_batches,
            'qa_hold_batches': qa_hold_batches,
            'completed_batches': completed_batches,
            'total_processes': total_processes,
            'total_stages': total_stages,
            'recent_batches': recent_batches,
        },
        'commercial': {
            'purchase_orders_pending': po_pending,
            'purchase_orders_total': po_total,
            'sales_orders_pending': so_pending,
            'sales_orders_total': so_total,
        }
    })
