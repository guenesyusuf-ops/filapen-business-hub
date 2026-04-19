import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. Check categories
const cats = await prisma.wmCategory.findMany({ orderBy: { position: 'asc' } });
console.log('=== Categories ===');
cats.forEach(c => console.log(`  "${c.name}" (id=${c.id}, pos=${c.position})`));

// 2. Check all projects with their type/category
const projects = await prisma.wmProject.findMany({
  orderBy: { createdAt: 'desc' },
  include: { columns: { orderBy: { position: 'asc' }, select: { name: true, position: true } } },
});
console.log('\n=== All Projects ===');
projects.forEach(p => {
  console.log(`  "${p.name}" type=${p.projectType} category="${p.category}" columns=${p.columns.map(c=>c.name).join(' → ')}`);
});

// 3. Check what /api/wm/categories would return (same query as service)
console.log('\n=== Vercel Deployment Check ===');
console.log('Latest commit should be: 870b164');
console.log('If user sees old text, Vercel has not deployed yet or browser cache');

await prisma.$disconnect();
