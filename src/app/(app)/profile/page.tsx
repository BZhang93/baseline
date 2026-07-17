import { redirect } from "next/navigation";
import { getCurrentSession, isProfileComplete } from "@/lib/player";
import { circuitForRankingTour } from "@/lib/circuit";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const p = session.player;
  const onboarding = !isProfileComplete(p);

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {onboarding ? "Welcome to Baseline" : "Profile"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {onboarding
          ? "Set up your profile to get started. Name, circuit, and ranking are required — the rest personalizes your Browse and schedules."
          : "Your ranking and preferences personalize Browse and your schedules."}
      </p>

      <ProfileForm
        email={session.email}
        onboarding={onboarding}
        initial={{
          name: p.name,
          ranking: p.ranking,
          circuit: p.circuit ?? circuitForRankingTour(p.rankingTour),
          tours: p.tours,
          nationality: p.nationality,
          homeBaseCity: p.homeBaseCity,
          homeBaseCountry: p.homeBaseCountry,
          surfacePrefs: p.surfacePrefs,
          budget: p.budget,
          currency: p.currency,
          unitSystem: p.unitSystem,
          transportModes: p.transportModes,
          lodgingTypes: p.lodgingTypes,
          travelSpend: p.travelSpend,
          lodgingSpend: p.lodgingSpend,
          dietaryPrefs: p.dietaryPrefs,
          maxDistanceToVenueKm: p.maxDistanceToVenueKm,
          lodgingAmenities: p.lodgingAmenities,
          tourProfileUrl: p.tourProfileUrl,
        }}
      />
    </div>
  );
}
