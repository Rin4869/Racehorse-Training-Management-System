import { setDefaultResultOrder } from 'dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Some PaaS hosts route outbound IPv6 poorly (e.g. to smtp.gmail.com),
// which manifests as a silent SMTP connection timeout rather than a clear
// network error. Prefer IPv4 for all DNS lookups process-wide.
setDefaultResultOrder('ipv4first');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.use(helmet());
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Racehorse Core API')
    .setDescription('Racehorse Training & Management System — Core API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `API on http://localhost:${port}/api/v1  ·  docs at /api/docs`,
  );
}

void bootstrap();
