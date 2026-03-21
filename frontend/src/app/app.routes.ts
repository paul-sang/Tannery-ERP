import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { MainLayoutComponent } from './shared/layouts/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ItemListComponent } from './features/inventory/items/item-list.component';
import { StocklotListComponent } from './features/inventory/stocklots/stocklot-list.component';
import { ProcessListComponent } from './features/production/processes/process-list.component';
import { BatchListComponent } from './features/production/batches/batch-list.component';
import { BatchDetailComponent } from './features/production/batches/batch-detail.component';
import { BatchCreateComponent } from './features/production/batches/batch-create.component';
import { PurchaseOrderListComponent } from './features/commercial/purchases/purchase-order-list.component';
import { SupplierListComponent } from './features/commercial/suppliers/supplier-list/supplier-list.component';
import { SalesOrderListComponent } from './features/commercial/sales/sales-order-list.component';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { 
        path: '', 
        component: MainLayoutComponent, 
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: DashboardComponent },
            { path: 'inventory', component: ItemListComponent },
            { path: 'inventory/lots', component: StocklotListComponent },
            { path: 'production/recipes', component: ProcessListComponent },
            { path: 'production/batches', component: BatchListComponent },
            { path: 'production/batches/new', component: BatchCreateComponent },
            { path: 'production/batches/:id', component: BatchDetailComponent },
            { path: 'commercial/purchases', component: PurchaseOrderListComponent },
            { path: 'commercial/purchases/suppliers', component: SupplierListComponent },
            { path: 'commercial/sales', component: SalesOrderListComponent },
            // Future feature routes will go here
        ]
    },
    { path: '**', redirectTo: 'dashboard' }
];

