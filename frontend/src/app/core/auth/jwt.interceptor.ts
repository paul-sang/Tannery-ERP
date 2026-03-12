import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Exclude auth routes from interception
  if (req.url.includes('/token/')) {
    return next(req);
  }

  let clonedReq = req;
  if (token) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 Unauthorized occurs, try to refresh the token
      if (error.status === 401) {
        return authService.refreshToken().pipe(
          switchMap((res: any) => {
            // Token refreshed, clone the original request with new token
            const newToken = authService.getToken();
            const retriedReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`
              }
            });
            return next(retriedReq);
          }),
          catchError((refreshError) => {
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
