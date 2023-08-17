import { Module } from '@nestjs/common';
import { GpsModule } from './gps/gps.module.js';

@Module({
  imports: [GpsModule],
})
export class AppModule {}
