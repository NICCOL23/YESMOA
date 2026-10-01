using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Management;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

public class SpecReport { public string schema="yesmoa-spec-v1"; public string brand="YESMOA-COM"; public string createdAt=DateTime.Now.ToString("yyyy-MM-dd HH:mm"); public List<SpecRow> items=new List<SpecRow>(); }
public class SpecRow { public string category; public string value; public SpecRow(){} public SpecRow(string c,string v){category=c;value=v;} }
public class Checker : Form {
SpecReport report; TextBox result; Button save,copy,image; Label state; static bool uiTest=false; static Color green=Color.FromArgb(14,115,94);
[STAThread] public static void Main(string[] args) {
if(args.Length>0 && args[0]=="--self-test") { var r=new SpecReport();r.items.Add(new SpecRow("CPU","테스트 CPU"));string json=Serialize(r);var x=new JavaScriptSerializer().Deserialize<SpecReport>(json);if(x.schema!="yesmoa-spec-v1"||x.items[0].value!="테스트 CPU")Environment.Exit(1);if(args.Length>1)File.WriteAllText(args[1],json,new UTF8Encoding(false));return; }
if(args.Length>0 && args[0]=="--query-test") { var r=Read(); if(r.items.Count<7)Environment.Exit(2); return; }
uiTest=args.Length>0 && args[0]=="--ui-test";
Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new Checker());
}
static string Serialize(SpecReport r){return new JavaScriptSerializer().Serialize(r);}
static string Val(ManagementBaseObject o,string k){return o[k]==null?"확인되지 않음":Convert.ToString(o[k]).Trim();}
static double Num(ManagementBaseObject o,string k){double n;return double.TryParse(Val(o,k),out n)?n:0;}
static void Query(SpecReport r,string cls,string props,string category,Func<ManagementBaseObject,string> fmt){try{using(var s=new ManagementObjectSearcher("SELECT "+props+" FROM "+cls)){s.Options.Timeout=TimeSpan.FromSeconds(15);using(var list=s.Get()){foreach(ManagementBaseObject o in list){using(o){r.items.Add(new SpecRow(category,fmt(o)));}}}}}catch{r.items.Add(new SpecRow(category,"조회 제한 또는 확인되지 않음"));}}
static SpecReport Read(){var r=new SpecReport();Query(r,"Win32_Processor","Name,NumberOfCores,NumberOfLogicalProcessors","CPU",o=>Val(o,"Name")+" / "+Val(o,"NumberOfCores")+"코어 · "+Val(o,"NumberOfLogicalProcessors")+"스레드");Query(r,"Win32_BaseBoard","Manufacturer,Product","메인보드",o=>Val(o,"Manufacturer")+" / "+Val(o,"Product"));Query(r,"Win32_VideoController","Name","그래픽카드",o=>Val(o,"Name")+" (전용 메모리는 작업 관리자에서 확인)");Query(r,"Win32_PhysicalMemory","Capacity,Speed,PartNumber,SMBIOSMemoryType","메모리 모듈",o=>Math.Round(Num(o,"Capacity")/1073741824,2)+" GiB / "+(Num(o,"SMBIOSMemoryType")==26?"DDR4":Num(o,"SMBIOSMemoryType")==34?"DDR5":"규격 확인 필요")+" / "+Val(o,"Speed")+" MHz / "+Val(o,"PartNumber"));Query(r,"Win32_DiskDrive","Model,Size","저장장치",o=>Val(o,"Model")+" / "+Math.Round(Num(o,"Size")/1073741824,1)+" GiB");Query(r,"Win32_ComputerSystem","Manufacturer,Model,TotalPhysicalMemory","시스템",o=>Val(o,"Manufacturer")+" / "+Val(o,"Model")+" / 총 메모리 "+Math.Round(Num(o,"TotalPhysicalMemory")/1073741824,1)+" GiB");Query(r,"Win32_OperatingSystem","Caption,OSArchitecture","운영체제",o=>Val(o,"Caption")+" / "+Val(o,"OSArchitecture"));return r;}
static string TextReport(SpecReport r){var b=new StringBuilder("YESMOA-COM | 내 PC 사양\r\n조회: "+r.createdAt+"\r\n\r\n");foreach(var x in r.items)b.AppendLine(x.category+"\r\n"+x.value+"\r\n");b.AppendLine("드라이버 제공 정보이며 작동 상태·매입가를 판정하지 않습니다.\r\n문의 010-9550-4687");return b.ToString();}
public Checker(){Text="YESMOA-COM · 내 PC 사양 확인";Size=new Size(780,760);MinimumSize=new Size(640,550);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.White;Font=new Font("맑은 고딕",10);var head=new Label{Text="YESMOA-COM   /   MY PC CHECK\r\n부품 정보를 확인하고, 원하는 결과만 공유하세요.",Dock=DockStyle.Top,Height=85,BackColor=green,ForeColor=Color.White,Padding=new Padding(22,15,0,0),Font=new Font("맑은 고딕",12,FontStyle.Bold)};result=new TextBox{Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Dock=DockStyle.Fill,BorderStyle=BorderStyle.None,Font=new Font("맑은 고딕",11),BackColor=Color.White};var panel=new Panel{Dock=DockStyle.Fill,Padding=new Padding(24)};panel.Controls.Add(result);var foot=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=110,Padding=new Padding(15),BackColor=Color.FromArgb(244,248,252)};save=ButtonOf("웹 결과 파일 저장",()=>SaveJson());copy=ButtonOf("텍스트 복사",()=>Clipboard.SetText(TextReport(report)));image=ButtonOf("이미지 저장",()=>SaveImage());foot.Controls.Add(save);foot.Controls.Add(copy);foot.Controls.Add(image);foot.Controls.Add(ButtonOf("닫기",()=>Close()));state=new Label{Text="조회 준비 중 · 자동 전송 없음",AutoSize=true,Margin=new Padding(5,10,0,0)};foot.Controls.Add(state);Controls.Add(panel);Controls.Add(foot);Controls.Add(head);save.Enabled=copy.Enabled=image.Enabled=false;Shown+=async (s,e)=>{result.Text="CPU · 메인보드 · 메모리 · 저장장치를 확인하고 있습니다…";report=await Task.Run(()=>Read());if(IsDisposed)return;result.Text=TextReport(report);save.Enabled=copy.Enabled=image.Enabled=true;state.Text="조회 완료 · 저장한 JSON 파일을 YESMOA 웹 화면에서 열어보세요.";if(uiTest){if(result.Text.Length<30 || !save.Enabled)Environment.Exit(3);Close();}};}
Button ButtonOf(string text,Action action){var b=new Button{Text=text,AutoSize=true,Height=36,FlatStyle=FlatStyle.Flat,BackColor=Color.White,ForeColor=green,Margin=new Padding(5)};b.Click+=(s,e)=>{try{action();}catch(Exception){MessageBox.Show("완료하지 못했습니다. 저장 위치 또는 클립보드 사용 상태를 확인하세요.","YESMOA");}};return b;}
void SaveJson(){using(var d=new SaveFileDialog{Filter="사양 결과 JSON|*.json",FileName="YESMOA-PC-사양.json"}){if(d.ShowDialog()==DialogResult.OK){File.WriteAllText(d.FileName,Serialize(report),new UTF8Encoding(false));state.Text="결과 파일 저장 완료 · 웹에서 ‘결과 파일 열기’를 눌러 선택하세요.";}}}
void SaveImage(){using(var d=new SaveFileDialog{Filter="PNG 이미지|*.png",FileName="YESMOA-PC-사양.png"}){if(d.ShowDialog()!=DialogResult.OK)return;using(var f=new Font("맑은 고딕",12))using(var measure=new Bitmap(1,1))using(var mg=Graphics.FromImage(measure)){string text=TextReport(report);var size=mg.MeasureString(text,f,700);using(var bmp=new Bitmap(760,(int)Math.Ceiling(size.Height)+70))using(var g=Graphics.FromImage(bmp)){g.Clear(Color.White);g.FillRectangle(new SolidBrush(green),0,0,760,10);g.DrawString(text,f,Brushes.Black,new RectangleF(30,30,700,size.Height+10));bmp.Save(d.FileName,System.Drawing.Imaging.ImageFormat.Png);}}state.Text="이미지 저장 완료 · 공유 여부는 직접 결정하세요.";}}
}


