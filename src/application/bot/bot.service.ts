import { Inject, Injectable } from '@nestjs/common';
import { UseCases } from '@common/tokens';

@Injectable()
export class BotService {
    private groups = [5947376037]; // Telegram group chat IDs

    constructor() {}

    async launch(): Promise<void> {
        this.sendMessagesToGroups();
    }

    private sendMessagesToGroups() {
        this.groups.forEach((groupID) => {
            const messagesCount = 200;
            for (let i = 0; i < messagesCount; i++) {
                const brokerMessage = JSON.stringify({
                    type: 'group',
                    chatId: groupID,
                    message: `${i} Random message`,
                    options: {
                        parse_mode: 'HTML',
                    },
                });

                // todo send message
            }
        });
    }
}
