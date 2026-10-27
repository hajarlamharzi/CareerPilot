"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { updateProfileAction } from "../actions";
import { INITIAL_PROFILE_FORM_STATE, type ProfileFormState } from "../types";

/** The values the form renders, already flattened from the database row. */
export interface ProfileFormValues {
  fullName: string;
  headline: string;
  location: string;
  phone: string;
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  bio: string;
}

function FormAlert({ state }: { state: ProfileFormState }) {
  if (!state.message) return null;
  const isSuccess = state.status === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        isSuccess
          ? "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <p>{state.message}</p>
    </div>
  );
}

interface FieldProps extends React.ComponentProps<"input"> {
  name: string;
  label: string;
  errors?: string[];
  hint?: React.ReactNode;
}

function Field({ name, label, errors, hint, id, ...props }: FieldProps) {
  const fieldId = id ?? `profile-${name}`;
  const error = errors?.[0];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ProfileForm({ profile }: { profile: ProfileFormValues }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    INITIAL_PROFILE_FORM_STATE,
  );

  const bioError = state.fieldErrors.bio?.[0];

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="fullName"
          label="Nom complet"
          autoComplete="name"
          defaultValue={profile.fullName}
          errors={state.fieldErrors.fullName}
        />
        <Field
          name="headline"
          label="Titre / poste visé"
          placeholder="Développeur front-end"
          defaultValue={profile.headline}
          errors={state.fieldErrors.headline}
        />
        <Field
          name="location"
          label="Localisation"
          autoComplete="address-level2"
          placeholder="Paris, France"
          defaultValue={profile.location}
          errors={state.fieldErrors.location}
        />
        <Field
          name="phone"
          label="Téléphone"
          type="tel"
          autoComplete="tel"
          defaultValue={profile.phone}
          errors={state.fieldErrors.phone}
        />
        <Field
          name="websiteUrl"
          label="Site web"
          type="url"
          placeholder="https://exemple.com"
          defaultValue={profile.websiteUrl}
          errors={state.fieldErrors.websiteUrl}
        />
        <Field
          name="linkedinUrl"
          label="LinkedIn"
          type="url"
          placeholder="https://linkedin.com/in/…"
          defaultValue={profile.linkedinUrl}
          errors={state.fieldErrors.linkedinUrl}
        />
        <Field
          name="githubUrl"
          label="GitHub"
          type="url"
          placeholder="https://github.com/…"
          defaultValue={profile.githubUrl}
          errors={state.fieldErrors.githubUrl}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-bio">Présentation</Label>
        <Textarea
          id="profile-bio"
          name="bio"
          rows={5}
          defaultValue={profile.bio}
          placeholder="Quelques lignes sur votre parcours et ce que vous recherchez."
          aria-invalid={bioError ? true : undefined}
          aria-describedby={bioError ? "profile-bio-error" : undefined}
        />
        {bioError ? (
          <p id="profile-bio-error" role="alert" className="text-xs font-medium text-destructive">
            {bioError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Cette présentation alimente votre CV et le contexte de l&apos;assistant.
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Enregistrement…
          </>
        ) : (
          "Enregistrer le profil"
        )}
      </Button>
    </form>
  );
}
