"use client"

import { cn } from "@/utils/ui"
import React, { useEffect, useState } from "react"
import { codeToHtml } from "shiki"

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
	children?: React.ReactNode
}

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
	return (
		<div
			className={cn(
				"not-prose flex w-full flex-col overflow-clip rounded-xl",
				"bg-[#1e1e1e] border border-border",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	)
}

interface CodeBlockCodeProps extends React.HTMLAttributes<HTMLDivElement> {
	code: string
	language?: string
	theme?: string
}

function CodeBlockCode({
	code,
	language = "tsx",
	theme = "github-dark",
	className,
	...props
}: CodeBlockCodeProps) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

	useEffect(() => {
		async function highlight() {
			if (!code) {
				setHighlightedHtml("<pre><code></code></pre>")
				return
			}

			const html = await codeToHtml(code, { lang: language, theme })
			setHighlightedHtml(html)
		}
		highlight()
	}, [code, language, theme])

	const classNames = cn(
		"w-full overflow-x-auto text-[13px] [&>pre]:px-4 [&>pre]:py-4",
		className,
	)

	// SSR fallback: render plain code if not hydrated yet
	return highlightedHtml ? (
		<div
			className={classNames}
			dangerouslySetInnerHTML={{ __html: highlightedHtml }}
			{...props}
		/>
	) : (
		<div className={classNames} {...props}>
			<pre>
				<code>{code}</code>
			</pre>
		</div>
	)
}

interface CodeBlockGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

function CodeBlockGroup({
	children,
	className,
	...props
}: CodeBlockGroupProps) {
	return (
		<div
			className={cn("flex items-center justify-between", className)}
			{...props}
		>
			{children}
		</div>
	)
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock }
