import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-11 w-full rounded-lg border border-line bg-card/70 px-3 py-2 text-sm text-foreground outline-none transition",
				"placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
