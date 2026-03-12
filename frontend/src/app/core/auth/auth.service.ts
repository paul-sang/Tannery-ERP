import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { tap, catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  public isAuthenticated = signal<boolean>(this.hasToken());

  login(credentials: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/token/`, credentials).pipe(
      tap((response: any) => {
        if (response && response.access) {
          localStorage.setItem('access_token', response.access);
          localStorage.setItem('refresh_token', response.refresh);
          this.isAuthenticated.set(true);
        }
      })
    );
  }

  refreshToken(): Observable<any> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post(`${environment.apiUrl}/token/refresh/`, { refresh }).pipe(
      tap((response: any) => {
        if (response && response.access) {
          localStorage.setItem('access_token', response.access);
          if (response.refresh) {
            localStorage.setItem('refresh_token', response.refresh);
          }
          this.isAuthenticated.set(true);
        }
      }),
      catchError((error) => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('access_token');
  }
}
