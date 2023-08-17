import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AccessToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (request.headers.authorization) {
      return request.headers.authorization;
    }
    console.log('url', request.url);
    const param = new URL('http://localhost' + request.url);
    if (param.searchParams.has('authorization')) {
      return param.searchParams.get('authorization');
    }
    return '';
  }
);
