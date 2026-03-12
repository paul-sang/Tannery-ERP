import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-offcanvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offcanvas.component.html'
})
export class OffcanvasComponent {
  @Input() isOpen = false;
  @Input() title = 'Filters';
  @Output() closeOffcanvas = new EventEmitter<void>();

  close() {
    this.closeOffcanvas.emit();
  }
}
