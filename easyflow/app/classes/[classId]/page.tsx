import Classwork from "@/app/Classwork/[classId]/page";

interface PageProps {
  params: Promise<{ classId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { classId } = await params;

  return <Classwork classId={classId} />;
}
