import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 overflow-hidden z-50 animate-fade-in-up" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div class="absolute inset-0 overflow-hidden">
        <!-- Background overlay -->
        <div class="absolute inset-0 bg-surface-dark/50 backdrop-blur-sm transition-opacity" (click)="close()" aria-hidden="true"></div>
        <div class="fixed inset-y-0 right-0 max-w-full flex">
          <!-- Drawer panel -->
          <div class="w-screen max-w-md md:max-w-2xl transform transition ease-in-out duration-300 sm:duration-500 translate-x-0" 
               [ngClass]="isOpen ? 'translate-x-0' : 'translate-x-full'">
            <div class="h-full flex flex-col bg-surface shadow-xl border-l border-border">
              
              <!-- Header -->
              <div class="px-4 py-6 sm:px-6 bg-surface-alt border-b border-border flex items-center justify-between">
                <h2 class="text-lg font-medium text-text" id="slide-over-title">
                  {{ title }}
                </h2>
                <div class="ml-3 h-7 flex items-center">
                  <button type="button" (click)="close()" class="bg-surface rounded-md text-text-muted hover:text-text focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer transition">
                    <span class="sr-only">Close panel</span>
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Main Content -->
              <div class="relative flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
                <ng-content></ng-content>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DrawerComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = 'Details';
  @Output() closeDrawer = new EventEmitter<void>();

  close() {
    this.closeDrawer.emit();
  }
}
