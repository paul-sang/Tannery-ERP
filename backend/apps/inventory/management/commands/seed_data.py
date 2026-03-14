from django.core.management.base import BaseCommand
from apps.users.models import User


class Command(BaseCommand):
    help = 'Seed the database with initial data'

    def handle(self, *args, **options):
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
            self.stdout.write(self.style.SUCCESS('Superuser "admin" created.'))
        else:
            self.stdout.write('Superuser already exists.')
