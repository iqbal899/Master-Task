"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OAuthProvider } from "node-appwrite";

import { createAdminClient } from "@/lib/appwrite";

function getSuccessRedirect() {
  const headerList = headers();
  const origin = headerList.get("origin");
  const referer = headerList.get("referer");

  if (referer && referer.includes("/join/")) {
    return referer;
  }


  return `${origin}/oauth`;
}

export async function signUpWithGithub() {
  const { account } = await createAdminClient();

  const headerList = headers();
  const origin = headerList.get("origin");

  const successUrl = getSuccessRedirect();

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Github,
    successUrl!,
    `${origin}/sign-in`
  );

  return redirect(redirectUrl);
}

export async function signUpWithGoogle() {
  const { account } = await createAdminClient();

  const headerList = headers();
  const origin = headerList.get("origin");

  const successUrl = getSuccessRedirect();

  const redirectUrl = await account.createOAuth2Token(
    OAuthProvider.Google,
    successUrl!,
    `${origin}/sign-in`
  );

  return redirect(redirectUrl);
}