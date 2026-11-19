import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HotelOperationsService } from './hotel-operations.service';
import { HotelReservationsController, HotelResourcesController } from './hotel-operations.controllers';
import { HotelFinanceController } from './hotel-finance.controllers';
import { HotelFinanceService } from './hotel-finance.service';
import { HotelFacilitiesController } from './hotel-facilities.controllers';
import { HotelFacilitiesService } from './hotel-facilities.service';
import { GuestAuthService } from '../guest/guest-auth.service';
import { GuestController, GuestIdentityGuard } from '../guest/guest.controllers';

@Module({
  imports: [AuthModule],
  controllers: [HotelResourcesController, HotelReservationsController, HotelFinanceController, HotelFacilitiesController, GuestController],
  providers: [HotelOperationsService, HotelFinanceService, HotelFacilitiesService, GuestAuthService, GuestIdentityGuard],
})
export class HotelOperationsModule {}
