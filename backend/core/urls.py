from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from apps.inventory.views_dashboard import dashboard_stats

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # OpenAPI Documentation endpoints
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # Authentication endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Dashboard
    path('api/dashboard/', dashboard_stats, name='dashboard-stats'),

    # Application endpoints
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/production/', include('apps.production.urls')),
    path('api/purchases/', include('apps.purchases.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/users/', include('apps.users.urls')),
]

