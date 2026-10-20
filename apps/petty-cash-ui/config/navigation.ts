import {
  BanknotesIcon,
  CheckBadgeIcon,
  ClockIcon,
  InboxStackIcon,
  ScaleIcon,
  WalletIcon,
} from '@heroicons/vue/24/outline';

export default [
  {
    groupName: '',
    items: [
      {
        label: 'Requests',
        url: '/',
        isHome: true,
        icon: InboxStackIcon,
      },
      {
        label: 'GS Approvals',
        url: '/approvals',
        icon: CheckBadgeIcon,
      },
      {
        label: 'Finance Desk',
        url: '/finance',
        icon: WalletIcon,
      },
      {
        label: 'History',
        url: '/requests',
        icon: ClockIcon,
      },
      {
        label: 'Reconciliation',
        url: '/reconciliation',
        icon: ScaleIcon,
      },
      {
        label: 'Ledger',
        url: '/fund',
        icon: BanknotesIcon,
      },
    ],
  },
];
