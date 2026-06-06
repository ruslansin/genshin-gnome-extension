export {Module} from './module.js';
export {fmtCompact, fmtTimer, RESIN_SECONDS} from './util.js';
export {MODULE_KEYS, MODULE_LABELS} from './metadata.js';

import ResinModule from './resin.js';
import CommissionsModule from './commissions.js';
import BossesModule from './bosses.js';
import ExpeditionsModule from './expeditions.js';
import CurrencyModule from './currency.js';
import TransformerModule from './transformer.js';
import AbyssModule from './abyss.js';
import ExplorationModule from './exploration.js';
import TheaterModule from './theater.js';
import DailyModule from './daily.js';
import ErrorModule from './error.js';
import AccountNameModule from './account-name.js';

export {
    ResinModule,
    CommissionsModule,
    BossesModule,
    ExpeditionsModule,
    CurrencyModule,
    TransformerModule,
    AbyssModule,
    ExplorationModule,
    TheaterModule,
    DailyModule,
    ErrorModule,
    AccountNameModule,
};

export const MODULE_REGISTRY = {
    resin: ResinModule,
    commissions: CommissionsModule,
    bosses: BossesModule,
    expeditions: ExpeditionsModule,
    currency: CurrencyModule,
    transformer: TransformerModule,
    abyss: AbyssModule,
    exploration: ExplorationModule,
    theater: TheaterModule,
    daily: DailyModule,
};
