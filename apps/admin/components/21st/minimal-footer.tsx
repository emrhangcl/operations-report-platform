// 21st.dev "Minimal Footer" (sshahaider / efferd) — https://21st.dev/@efferd/components/minimal-footer
// Orijinal kod. Farklar: logo owner panelindeki isaret; genislik sayfa icerigiyle ayni (max-w-7xl); sitenin sosyal medya hesabi olmadigi icin sosyal
// dugmeler cikarildi; baglantilar ve metinler Turkce, ic sayfalar next/link ile.
import Link from 'next/link';
import { IconInnerShadowTop } from '@tabler/icons-react';

export function MinimalFooter() {
	const year = new Date().getFullYear();

	const company = [
		{
			title: 'İletişim',
			href: '/contact',
		},
		{
			title: 'Gizlilik',
			href: '/privacy',
		},
		{
			title: 'Kullanım Şartları',
			href: '/terms',
		},
	];

	const resources = [
		{
			title: 'Özellikler',
			href: '#ozellikler',
		},
		{
			title: 'Fiyatlar',
			href: '#fiyatlar',
		},
		{
			title: 'Giriş',
			href: '/login',
		},
		{
			title: 'Firma Kaydı',
			href: '/register',
		},
	];

	return (
		<footer className="relative">
			<div className="bg-[radial-gradient(35%_80%_at_30%_0%,--theme(--color-foreground/.1),transparent)] mx-auto max-w-7xl md:border-x">
				<div className="bg-border absolute inset-x-0 h-px w-full" />
				<div className="grid max-w-7xl grid-cols-6 gap-6 p-4">
					<div className="col-span-6 flex flex-col gap-5 md:col-span-4">
						<Link href="/" className="w-max opacity-25" aria-label="Operasyon Portalı">
							<IconInnerShadowTop className="size-8" />
						</Link>
						<p className="text-muted-foreground max-w-sm font-mono text-sm text-balance">
							Atamadan imzalı rapora saha operasyonu platformu.
						</p>
					</div>
					<div className="col-span-3 w-full md:col-span-1">
						<span className="text-muted-foreground mb-1 text-xs">
							Ürün
						</span>
						<div className="flex flex-col gap-1">
							{resources.map(({ href, title }, i) => (
								<Link
									key={i}
									className={`w-max py-1 text-sm duration-200 hover:underline`}
									href={href}
								>
									{title}
								</Link>
							))}
						</div>
					</div>
					<div className="col-span-3 w-full md:col-span-1">
						<span className="text-muted-foreground mb-1 text-xs">Kurumsal</span>
						<div className="flex flex-col gap-1">
							{company.map(({ href, title }, i) => (
								<Link
									key={i}
									className={`w-max py-1 text-sm duration-200 hover:underline`}
									href={href}
								>
									{title}
								</Link>
							))}
						</div>
					</div>
				</div>
				<div className="bg-border absolute inset-x-0 h-px w-full" />
				<div className="flex max-w-7xl flex-col justify-between gap-2 pt-2 pb-5">
					<p className="text-muted-foreground text-center font-thin">
						© Operasyon Portalı. Tüm hakları saklıdır {year}
					</p>
				</div>
			</div>
		</footer>
	);
}
