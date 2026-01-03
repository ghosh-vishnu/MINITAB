"""
URL configuration for spreadsheet application.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/spreadsheets/', include('apps.spreadsheets.urls')),
    path('api/analysis/', include('apps.analysis.urls')),
    path('api/charts/', include('apps.charts.urls')),
    path('api/rbac/', include('apps.rbac.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


