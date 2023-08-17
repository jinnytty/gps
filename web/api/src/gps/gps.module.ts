import { Module } from '@nestjs/common';
import GpsController from './gps.controller.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  controllers: [GpsController],
  imports: [CommonModule],
  providers: [],
})
export class GpsModule {}
