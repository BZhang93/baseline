import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { circuitForRankingTour } from "@/lib/circuit";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const p = session.player;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your ranking and preferences personalize Browse and your schedules.
      </p>

      <ProfileForm
        email={session.email}
        initial={{
          name: p.name,
          ranking: p.ranking,
          circuit: p.circuit ?? circuitForRankingTour(p.rankingTour),
          tours: p.tours,
          nationality: p.nationality,
          homeBaseCity: p.homeBaseCity,
          homeBaseCountry: p.homeBaseCountry,
          surfacePrefs: p.surfacePrefs,
          budgetTier: p.budgetTier,
          unitSystem: p.unitSystem,
          transportModes: p.transportModes,
          lodgingTypes: p.lodgingTypes,
          travelSpend: p.travelSpend,
          lodgingSpend: p.lodgingSpend,
          dietaryPrefs: p.dietaryPrefs,
          maxDistanceToVenueKm: p.maxDistanceToVenueKm,
          lodgingAmenities: p.lodgingAmenities,
        }}
      />
    </div>
  );
}
