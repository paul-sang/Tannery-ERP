import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.inventory.models import Item
from apps.inventory.views import ItemViewSet
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()
request = factory.get('/')
view = ItemViewSet.as_view({'get': 'stock_report'})

# Get an item id to test
item = Item.objects.first()
if item:
    print(f"Testing item {item.id}")
    response = view(request, pk=item.id)
    print(response.data)
else:
    print("No items found.")
