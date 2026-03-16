import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

interface DashboardData {
  user: { username: string; role: string; role_display: string; full_name: string };
  inventory: {
    items_total: number; low_stock_count: number; low_stock_items: any[];
    lots_active: number; total_stock_units: number;
    docs_today: number; docs_7d: number; recent_documents: any[];
  };
  production: {
    active_batches: number; pending_batches: number; qa_hold_batches: number;
    completed_batches: number; total_processes: number; total_stages: number;
    recent_batches: any[];
  };
  commercial: {
    purchase_orders_pending: number; purchase_orders_total: number;
    sales_orders_pending: number; sales_orders_total: number;
  };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  data = signal<DashboardData | null>(null);
  isLoading = signal(true);
  currentTime = signal(new Date());

  role = computed(() => this.data()?.user?.role || 'ADMIN');
  greeting = computed(() => {
    const h = this.currentTime().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  });

  // Visibility helpers per role
  showInventory = computed(() => ['ADMIN', 'INV_MGR'].includes(this.role()));
  showProduction = computed(() => ['ADMIN', 'PROD_MGR'].includes(this.role()));
  showCommercial = computed(() => ['ADMIN', 'SALES', 'PURCHASES'].includes(this.role()));
  showPurchases = computed(() => ['ADMIN', 'PURCHASES'].includes(this.role()));
  showSales = computed(() => ['ADMIN', 'SALES'].includes(this.role()));

  ngOnInit() {
    this.authService.loadProfile();
    this.loadDashboard();
    setInterval(() => this.currentTime.set(new Date()), 60000);
  }

  loadDashboard() {
    this.isLoading.set(true);
    this.http.get<DashboardData>(`${environment.apiUrl}/dashboard/`).subscribe({
      next: (res) => { this.data.set(res); this.isLoading.set(false); },
      error: () => this.isLoading.set(false)
    });
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  getBatchStatusColor(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-surface-alt text-text-muted';
      case 'IN_PROGRESS': return 'bg-primary/15 text-primary';
      case 'QA_HOLD': return 'bg-warning/15 text-warning';
      case 'COMPLETED': return 'bg-success/15 text-success';
      case 'CANCELLED': return 'bg-danger/15 text-danger';
      default: return 'bg-surface-alt text-text-muted';
    }
  }

  getDocTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'ADJ': 'Adjustment', 'PUR': 'Purchase', 'SAL': 'Sales',
      'PCN': 'Consumption', 'POT': 'Output', 'TRF': 'Transfer', 'INI': 'Initial'
    };
    return map[type] || type;
  }

  getDocTypeColor(type: string): string {
    const map: Record<string, string> = {
      'ADJ': 'bg-primary/10 text-primary', 'PUR': 'bg-info/10 text-info-foreground',
      'SAL': 'bg-accent/10 text-accent', 'PCN': 'bg-warning/10 text-warning',
      'POT': 'bg-success/10 text-success', 'TRF': 'bg-surface-alt text-text-muted',
      'INI': 'bg-surface-alt text-text-muted'
    };
    return map[type] || 'bg-surface-alt text-text-muted';
  }
}
