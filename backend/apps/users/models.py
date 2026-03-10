from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrator'
        PRODUCTION_MANAGER = 'PROD_MGR', 'Production Manager'
        INVENTORY_MANAGER = 'INV_MGR', 'Inventory Manager'
        SALES = 'SALES', 'Sales Representative'
        PURCHASES = 'PURCHASES', 'Purchasing Agent'
    
    role = models.CharField(
        max_length=20, 
        choices=Role.choices, 
        default=Role.ADMIN
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
