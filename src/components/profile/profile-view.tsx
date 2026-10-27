"use client";

import * as React from "react";
import { CheckCircle2, Info, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ProfileForm,
  type ProfileFormValues,
} from "@/features/profile/components/profile-form";
import {
  EMPTY_PROFILE,
  profileUpdateSchema,
  type ProfileUpdateInput,
} from "@/features/profile/schemas";
import { updateProfile } from "@/features/workspace/profile";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { DataMode } from "@/lib/auth/session";
import { formatDateShort } from "@/lib/format";
import type { CandidateProfile } from "@/types";

/**
 * Profile screen.
 *
 * Two implementations behind one shell, because the two data modes are genuinely
 * different and pretending otherwise would mean lying somewhere:
 *
 *  * **cloud** — a Server Action writes to PostgreSQL under row-level security;
 *  * **local demo** — the browser writes to its own workspace store, and the page
 *    says so instead of implying the entry was saved to an account.
 *
 * The side panel is identical in both modes, which is the point: what differs is
 * where the data lives, and only the form needs to know.
 */

interface ProfileViewProps {
  mode: DataMode;
  /** Present in cloud mode only: the row as stored. */
  initialProfile: ProfileUpdateInput | null;
  account: {
    email: string | null;
    roles: readonly Role[];
  };
}

export function ProfileView({ mode, initialProfile, account }: ProfileViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        {mode === "cloud" ? (
          <Card>
            <CardHeader>
              <CardTitle>Vos informations</CardTitle>
              <CardDescription>
                Elles apparaissent sur votre CV et servent au calcul d&apos;adéquation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm profile={initialProfile ?? EMPTY_PROFILE} />
            </CardContent>
          </Card>
        ) : (
          <LocalProfileForm />
        )}
      </div>

      <div className="space-y-6">
        <AccountCard mode={mode} account={account} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confidentialité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Ces informations servent à calculer l&apos;adéquation des offres et à
              rédiger vos documents. Elles ne sont jamais publiées ni transmises à
              des recruteurs par CareerPilot.
            </p>
            <p>
              L&apos;assistant ne reçoit que ce qui est utile : vos compétences, votre
              titre, votre localisation et vos préférences — jamais votre adresse
              e-mail ni votre téléphone.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local demo: the browser's own workspace store
// ---------------------------------------------------------------------------

function LocalProfileForm() {
  const ready = useStoreReady();
  const profile = useWorkspaceDomain("profile");
  /** Edit buffer. `null` means "show whatever the store currently holds". */
  const [draft, setDraft] = React.useState<ProfileUpdateInput | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const values = draft ?? (profile ? profileToValues(profile) : EMPTY_PROFILE);

  function setField(name: keyof ProfileUpdateInput, value: string) {
    setDraft((current) => ({ ...(current ?? values), [name]: value }));
    setMessage(null);
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = profileUpdateSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      setMessage("Certains champs doivent être corrigés.");
      setSaved(false);
      return;
    }

    // The local store calls this field `summary`; the form uses the database's
    // `bio`. One rename, in one place.
    const result = updateProfile({
      fullName: parsed.data.fullName,
      headline: parsed.data.headline || null,
      location: parsed.data.location || null,
      phone: parsed.data.phone || null,
      website: parsed.data.websiteUrl || null,
      linkedin: parsed.data.linkedinUrl || null,
      github: parsed.data.githubUrl || null,
      summary: parsed.data.bio || null,
    });

    setFieldErrors({});

    if (!result) {
      setMessage(
        "Enregistrement impossible : le stockage de ce navigateur est indisponible ou vide.",
      );
      setSaved(false);
      return;
    }

    setDraft(null);
    setMessage("Profil enregistré dans ce navigateur.");
    setSaved(true);
    toast.success("Profil enregistré");
  }

  if (!ready) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vos informations</CardTitle>
        <CardDescription>
          Enregistrées dans ce navigateur uniquement.{" "}
          {profile?.updatedAt
            ? `Dernière modification le ${formatDateShort(profile.updatedAt)}.`
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <ProfileFields
            values={values}
            onChange={setField}
            fieldErrors={fieldErrors}
          />

          {message ? <FormFeedback success={saved} message={message} /> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit">
              <Save className="size-4" aria-hidden="true" />
              Enregistrer
            </Button>
            {draft ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setFieldErrors({});
                  setMessage(null);
                  setSaved(false);
                }}
              >
                Annuler les modifications
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared presentation
// ---------------------------------------------------------------------------

interface FieldSpec {
  name: keyof ProfileUpdateInput;
  label: string;
  type?: "text" | "tel" | "url";
  autoComplete?: string;
  placeholder?: string;
  maxLength: number;
  textarea?: boolean;
}

const FIELDS: readonly FieldSpec[] = [
  { name: "fullName", label: "Nom complet", autoComplete: "name", maxLength: 120 },
  {
    name: "headline",
    label: "Titre / poste visé",
    placeholder: "Développeur front-end",
    autoComplete: "organization-title",
    maxLength: 160,
  },
  {
    name: "location",
    label: "Localisation",
    placeholder: "Paris, France",
    autoComplete: "address-level2",
    maxLength: 160,
  },
  {
    name: "phone",
    label: "Téléphone",
    type: "tel",
    autoComplete: "tel",
    placeholder: "+33 6 12 34 56 78",
    maxLength: 40,
  },
  {
    name: "websiteUrl",
    label: "Site web",
    type: "url",
    autoComplete: "url",
    placeholder: "https://exemple.com",
    maxLength: 2048,
  },
  {
    name: "linkedinUrl",
    label: "LinkedIn",
    type: "url",
    placeholder: "https://linkedin.com/in/…",
    maxLength: 2048,
  },
  {
    name: "githubUrl",
    label: "GitHub",
    type: "url",
    placeholder: "https://github.com/…",
    maxLength: 2048,
  },
  {
    name: "bio",
    label: "Présentation",
    textarea: true,
    placeholder:
      "Quelques lignes sur votre parcours, vos domaines de prédilection et le poste recherché.",
    maxLength: 4000,
  },
];

function ProfileFields({
  values,
  onChange,
  fieldErrors,
}: {
  values: ProfileUpdateInput;
  onChange: (name: keyof ProfileUpdateInput, value: string) => void;
  fieldErrors: Record<string, string[]>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => {
        const id = `profile-${field.name}`;
        const error = fieldErrors[field.name]?.[0];
        const shared = {
          id,
          name: field.name,
          value: values[field.name],
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? `${id}-error` : undefined,
          onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => onChange(field.name, event.target.value),
        };

        return (
          <div
            key={field.name}
            className={field.textarea ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
          >
            <Label htmlFor={id}>{field.label}</Label>

            {field.textarea ? (
              <Textarea
                {...shared}
                rows={5}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
              />
            ) : (
              <Input
                {...shared}
                type={field.type ?? "text"}
                maxLength={field.maxLength}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
              />
            )}

            {error ? (
              <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FormFeedback({ success, message }: { success: boolean; message: string }) {
  return (
    <p
      role={success ? "status" : "alert"}
      aria-live="polite"
      className={
        success
          ? "flex items-start gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      }
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </p>
  );
}

function AccountCard({
  mode,
  account,
}: {
  mode: DataMode;
  account: { email: string | null; roles: readonly Role[] };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {mode === "cloud" ? (
          <>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Adresse e-mail</p>
              <p className="font-medium">{account.email ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Rôles</p>
              {account.roles.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {account.roles.map((role) => (
                    <Badge
                      key={role}
                      variant={role === "admin" ? "default" : "secondary"}
                    >
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun rôle attribué.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Les rôles sont accordés côté serveur : ils ne peuvent pas être
              modifiés depuis cette page.
            </p>
          </>
        ) : (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Mode démo local : il n&apos;y a pas de compte, donc pas de connexion à
            protéger. Vos données restent dans ce navigateur.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function profileToValues(profile: CandidateProfile): ProfileFormValues {
  return {
    fullName: profile.fullName ?? "",
    headline: profile.headline ?? "",
    location: profile.location ?? "",
    phone: profile.phone ?? "",
    websiteUrl: profile.website ?? "",
    linkedinUrl: profile.linkedin ?? "",
    githubUrl: profile.github ?? "",
    bio: profile.summary ?? "",
  };
}
