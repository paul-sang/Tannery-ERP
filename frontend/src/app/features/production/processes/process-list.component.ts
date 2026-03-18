import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductionService, ProductionProcess, ProductionStage } from '../../../core/api/production.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { ProcessFormComponent } from './process-form.component';
import { OffcanvasComponent } from '../../../shared/components/offcanvas/offcanvas.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-process-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, ProcessFormComponent, OffcanvasComponent],
  templateUrl: './process-list.component.html'
})
export class ProcessListComponent implements OnInit {
  private productionService = inject(ProductionService);
  private toastService = inject(ToastService);

  processes = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  isFormOpen = signal<boolean>(false);

  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  searchControl = new FormControl('');
  searchQuery = signal<string>('');
  activeOrdering = signal<string>('');

  // Filters
  isFilterOpen = signal<boolean>(false);
  stages = signal<ProductionStage[]>([]);
  filterStageControl = new FormControl('');
  filterStatusControl = new FormControl('');

  // Detail offcanvas
  selectedProcess = signal<ProductionProcess | null>(null);
  isDetailOpen = signal<boolean>(false);
  editingProcess = signal<ProductionProcess | null>(null);

  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Recipe Name', sortable: true },
    { key: 'stage_name', label: 'Production Stage', sortable: true, sortKey: 'stage__name' },
    { key: 'inputs_count', label: 'Inputs' },
    { key: 'chemicals_count', label: 'Chemicals' },
    { key: 'outputs_count', label: 'Outputs' },
    { key: 'status_badge', label: 'Status', type: 'badge', sortable: true, sortKey: 'is_active' }
  ];

  ngOnInit() {
    this.fetchStages();
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery.set(value || '');
      this.currentPage.set(1);
      this.fetchProcesses();
    });
    this.fetchProcesses();
  }

  fetchStages() {
    this.productionService.getStages().subscribe(response => {
      this.stages.set(response.results);
    });
  }

  fetchProcesses() {
    this.isLoading.set(true);
    const stage = this.filterStageControl.value || undefined;
    const isActive = this.filterStatusControl.value || undefined;
    this.productionService.getProcesses(this.currentPage(), this.pageSize(), this.searchQuery(), this.activeOrdering(), stage, isActive).subscribe({
      next: (response) => {
        const mappedData = response.results.map((proc: ProductionProcess) => ({
          ...proc,
          inputs_count: proc.expected_inputs?.length ?? 0,
          chemicals_count: proc.chemicals?.length ?? 0,
          outputs_count: proc.expected_outputs?.length ?? 0,
          status_badge: proc.is_active ? 'Active' : 'Inactive'
        }));
        this.processes.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.error('Connection Error', 'Failed to load Production Recipes.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.selectedProcess.set(row as ProductionProcess);
    this.isDetailOpen.set(true);
  }

  closeDetail() {
    this.isDetailOpen.set(false);
    this.selectedProcess.set(null);
  }

  openForm(process?: ProductionProcess) {
    this.editingProcess.set(process || null);
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
    this.editingProcess.set(null);
  }

  onProcessSaved() {
    this.fetchProcesses();
    this.closeDetail();
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.fetchProcesses();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchProcesses();
  }

  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.activeOrdering.set(`${orderPrefix}${event.column}`);
    this.currentPage.set(1);
    this.fetchProcesses();
  }

  openFilters() {
    this.isFilterOpen.set(true);
  }

  closeFilters() {
    this.isFilterOpen.set(false);
  }

  applyFilters() {
    this.currentPage.set(1);
    this.fetchProcesses();
    this.closeFilters();
  }

  clearFilters() {
    this.filterStageControl.setValue('');
    this.filterStatusControl.setValue('');
    this.currentPage.set(1);
    this.fetchProcesses();
    this.closeFilters();
  }
}
