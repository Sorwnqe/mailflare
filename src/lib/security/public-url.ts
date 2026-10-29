import { isForbiddenHostname, isIpLiteral } from "@/lib/remote-images/fetch";

/**
 * Text-level check that a URL we are asked to call points at a public HTTPS host. It cannot see
 * what the name resolves to, so redirects stay disabled at the call site.
 */
export function isPublicHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password && !!url.hostname && !isIpLiteral(url.hostname) && !isForbiddenHostname(url.hostname);
	} catch {
		return false;
	}
}

export const PUBLIC_HTTPS_URL_MESSAGE = "Webhook URLs must use https:// and point at a public host";
