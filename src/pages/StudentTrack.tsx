import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import StudentTrackView from "@/components/student/StudentTrackView";

const StudentTrack = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-3" dir="rtl">
      <Button variant="ghost" size="sm" className="print:hidden" onClick={() => navigate(-1)}><ArrowRight className="w-4 h-4 ml-1" />رجوع</Button>
      {id && <StudentTrackView studentId={id} />}
    </div>
  );
};

export default StudentTrack;
