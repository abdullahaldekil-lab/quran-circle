import { useNavigate } from "react-router-dom";

interface StudentNameLinkProps {
  studentId: string;
  studentName: string;
  className?: string;
}

const StudentNameLink = ({ studentId, studentName, className = "" }: StudentNameLinkProps) => {
  const navigate = useNavigate();

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/students/${studentId}`);
      }}
      className={`cursor-pointer font-medium transition-colors hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline underline-offset-2 ${className}`}
    >
      {studentName}
    </span>
  );
};

export default StudentNameLink;
