from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.production.models import ProductionStage, ProductionProcess, ProductionBatch
from apps.inventory.models import Item, ProductCategory, UnitOfMeasure, StockLot, InventoryDocument
from decimal import Decimal

User = get_user_model()

class ProductionBatchCreationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(username='admin', password='password', email='admin@test.com')
        self.client.force_authenticate(user=self.user)
        
        self.uom = UnitOfMeasure.objects.create(name='Kilogram', abbreviation='kg')
        self.category = ProductCategory.objects.create(name='RAW_HIDE')
        self.item = Item.objects.create(
            sku='HIDE-001', name='Raw Hide', category=self.category, uom=self.uom, track_by_lot=True
        )
        self.lot = StockLot.objects.create(
            item=self.item, lot_tracking_number='LOT-XYZ', current_primary_quantity=100
        )
        
        self.stage = ProductionStage.objects.create(name='Tanning', sequence_order=1)
        self.process = ProductionProcess.objects.create(name='Standard Tanning', stage=self.stage)

    def test_create_batch_with_initial_lots(self):
        url = '/api/production/batches/'
        data = {
            'process': self.process.id,
            'base_weight': 1500.50,
            'quantity_hides': 300,
            'notes': 'Test batch',
            'initial_lots': [
                {
                    'lot_id': self.lot.id,
                    'item_id': self.item.id,
                    'quantity': 50.0
                }
            ]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 201)
        batch_id = response.data['id']
        batch = ProductionBatch.objects.get(id=batch_id)
        
        self.assertEqual(batch.base_weight, Decimal('1500.50'))
        self.assertEqual(batch.quantity_hides, 300)
        
        # Verify InventoryDocument was created
        doc = InventoryDocument.objects.filter(production_batch=batch, document_type='PCN').first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.lines.count(), 1)
        line = doc.lines.first()
        self.assertEqual(line.item, self.item)
        self.assertEqual(line.stock_lot, self.lot)
        self.assertEqual(line.quantity, Decimal('50.0'))
        self.assertEqual(line.movement_type, 'OUT')
