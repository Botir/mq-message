import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@common/config';

@Global()
@Module({
    imports: [],
    providers: [ConfigService],
    exports: [ConfigService],
})
export class SharedModule {}
