import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { ProfileForm } from "./_components/profile-form";

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const p = session.player;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Signed in as {session.email}. Your ranking and preferences personalise
        Browse and your schedules.
      </p>

      <ProfileForm
        initial={{
          name: p.name,
          ranking: p.ranking,
          rankingTour: p.rankingTour,
          nationality: p.nationality,
          homeBaseCity: p.homeBaseCity,
          homeBaseCountry: p.homeBaseCountry,
          surfacePrefs: p.surfacePrefs,
          budgetTier: p.budgetTier,
          unitSystem: p.unitSystem,
          dietaryPrefs: p.dietaryPrefs,
          maxDistanceToVenueKm: p.maxDistanceToVenueKm,
          lodgingAmenities: p.lodgingAmenities,
        }}
      />
    </div>
  );
}
