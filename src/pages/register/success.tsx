import { useNavigate } from 'react-router-dom';
import { Package, MapPin, Users, Rocket } from 'lucide-react';

export default function RegisterSuccessScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0e1117] flex items-center justify-center p-6 text-white font-sans" dir="rtl">
      <div className="max-w-2xl w-full bg-[#161b22] border border-[#30363d] rounded-2xl p-10 shadow-2xl animate-fade-in relative overflow-hidden">
        
        {/* Confetti / Decorative Accent */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-500"></div>

        <div className="text-center mb-10">
          <div className="mx-auto w-24 h-24 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mb-6 border border-blue-500/30">
            <Rocket size={48} className="animate-bounce" />
          </div>
          <h1 className="text-4xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-l from-white to-gray-400">
            🎉 مرحباً بك في نواه!
          </h1>
          <p className="text-[#8b949e] text-lg font-medium">
            تم إنشاء حساب شركتك بنجاح. أنت الآن جاهز لبناء إمبراطوريتك.
          </p>
        </div>

        <div className="bg-[#0d1017] border border-[#30363d] rounded-xl p-6 mb-10">
          <h3 className="text-lg font-bold text-white mb-4">الخطوات التالية لتجهيز نظامك:</h3>
          
          <ul className="space-y-4">
            <li className="flex items-center gap-4 text-[#c9d1d9] bg-[#161b22] p-4 rounded-lg border border-[#30363d]/50 hover:border-blue-500/50 transition-colors">
              <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400"><Package size={24} /></div>
              <div>
                <strong className="block text-white">إضافة المنتجات والخدمات</strong>
                <span className="text-sm text-[#8b949e]">قم برفع قائمة منتجاتك لتفعيل نقاط البيع</span>
              </div>
            </li>
            
            <li className="flex items-center gap-4 text-[#c9d1d9] bg-[#161b22] p-4 rounded-lg border border-[#30363d]/50 hover:border-emerald-500/50 transition-colors">
              <div className="bg-emerald-600/20 p-2 rounded-lg text-emerald-400"><MapPin size={24} /></div>
              <div>
                <strong className="block text-white">إعداد الفروع والمستودعات</strong>
                <span className="text-sm text-[#8b949e]">قم بتحديد مواقع أعمالك لتوزيع المخزون</span>
              </div>
            </li>

            <li className="flex items-center gap-4 text-[#c9d1d9] bg-[#161b22] p-4 rounded-lg border border-[#30363d]/50 hover:border-purple-500/50 transition-colors">
              <div className="bg-purple-600/20 p-2 rounded-lg text-purple-400"><Users size={24} /></div>
              <div>
                <strong className="block text-white">دعوة فريق العمل</strong>
                <span className="text-sm text-[#8b949e]">أضف الموظفين وحدد صلاحياتهم في النظام</span>
              </div>
            </li>
          </ul>
        </div>

        <button 
          onClick={() => navigate('/dashboard')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
        >
          الدخول إلى لوحة التحكم ←
        </button>

      </div>
    </div>
  );
}
