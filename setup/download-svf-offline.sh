# run command download.sh

wget --compression=auto -r -i lmvfilelist.txt

mv autodeskviewer.com/viewers/latest/ ./lmv
mv fonts.autodesk.com ./lmv
rm -fr autodeskviewer.com

# Switch Forge logo for ACME Logo
wget https://e7.pngegg.com/pngimages/135/411/png-clipart-acme-markets-havertown-grocery-store-supermarket-retail-others-miscellaneous-angle.png
mkdir ../lmv/res/ui
mv png-clipart-acme-markets-havertown-grocery-store-supermarket-retail-others-miscellaneous-angle.png ../lmv/res/ui/forge-logo.png 