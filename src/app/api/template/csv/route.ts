import { NextResponse } from "next/server";

export async function GET() {
  const headers = "productName,category,attributes\n";
  const example = `Camiseta de algodón orgánico,Ropa,"{""talla"":""M-L"",""color"":""Blanco"",""material"":""100% Algodón orgánico""}"\n`;
  const example2 = `Auriculares inalámbricos,Electrónica,"{""batería"":""30h"",""conexión"":""Bluetooth 5.3"",""resistencia"":""IPX4""}"\n`;

  const csvContent = headers + example + example2;

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="plantilla_listwise.csv"',
    },
  });
}
