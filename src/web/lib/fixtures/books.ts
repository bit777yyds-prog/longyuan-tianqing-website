import type { Book } from '@longyuan/shared';

export const books: Book[] = [
  {
    id: 'book-001',
    title: '龙渊天青：瓷土之书',
    series: '龙渊天青系列',
    coverUrl: '/covers/celadon-earth.jpg',
    tagline: '从瓷土到釉色，一部关于材料与手艺的考古。',
    status: 'published',
    author: '沈青',
    year: 2025,
    description:
      '本书追踪青瓷原料的来源、配方与变迁，结合文献与田野调查，呈现瓷土作为文化载体的多重面貌。',
  },
  {
    id: 'book-002',
    title: '龙渊天青：窑火之书',
    series: '龙渊天青系列',
    coverUrl: '/covers/celadon-fire.jpg',
    tagline: '火焰、温度与失败，烧造背后的决策史。',
    status: 'in_progress',
    author: '沈青',
    year: 2026,
    description:
      '以历代窑址记录和实验考古数据为基础，还原青瓷烧造中的技术选择与文化记忆。',
  },
  {
    id: 'book-003',
    title: '龙渊天青：水形之书',
    series: '龙渊天青系列',
    coverUrl: '/covers/celadon-water.jpg',
    tagline: '釉色如水，器物如舟，关于青瓷的审美考古。',
    status: 'upcoming',
    author: '林澜',
    year: 2026,
    description:
      '从釉色、器型到使用场景，探索青瓷如何在不同历史语境中被观看与消费。',
  },
];
